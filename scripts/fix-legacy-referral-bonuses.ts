import "dotenv/config";
import { pool } from "../server/db";

type TopPointsRow = {
  id: string;
  username: string | null;
  points: number | null;
};

type LegacyDefaultRow = {
  user_id: string;
  username: string | null;
  points: number | null;
};

type DailySigninRow = {
  user_id: string;
  username: string | null;
  points: number | null;
  tx_ids: number[];
  correction_amount: string;
};

type DuplicateReferralRow = {
  user_id: string;
  username: string | null;
  points: number | null;
  tx_ids: number[];
  correction_amount: string;
};

type CorrectionCategory = {
  kind: "legacy_default" | "daily_signin" | "duplicate_referral";
  amount: number;
  description: string;
};

type UserCorrection = {
  userId: string;
  username: string | null;
  currentPoints: number;
  categories: CorrectionCategory[];
};

const APPLY = String(process.env.APPLY || "").toLowerCase() === "true";
const CURRENT_SIGNUP_REWARD = 5;
const LEGACY_DEFAULT_POINTS = 1000;
const DAILY_SIGNIN_TARGET = 5;
const LEGACY_DEFAULT_EXCESS = LEGACY_DEFAULT_POINTS - CURRENT_SIGNUP_REWARD;

function toAmount(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getOrCreateUserCorrection(
  map: Map<string, UserCorrection>,
  userId: string,
  username: string | null,
  currentPoints: number,
): UserCorrection {
  const existing = map.get(userId);
  if (existing) return existing;
  const created: UserCorrection = {
    userId,
    username,
    currentPoints,
    categories: [],
  };
  map.set(userId, created);
  return created;
}

async function main() {
  const client = await pool.connect();

  try {
    const rewardTypesThatShouldExistForRealPoints = [
      "signup_bonus",
      "referral_bonus",
      "referral_reward",
      "challenge_creation_reward",
      "bantcredit_correction",
    ];

    const [topPointsRows, legacyDefaultRows, dailySigninRows, duplicateReferralRows] =
      await Promise.all([
        client.query<TopPointsRow>(
          `
            SELECT id, username, points
            FROM users
            WHERE COALESCE(points, 0) >= 1000
            ORDER BY points DESC, created_at ASC
            LIMIT 25
          `,
        ),
        client.query<LegacyDefaultRow>(
          `
            SELECT u.id AS user_id, u.username, u.points
            FROM users u
            WHERE COALESCE(u.is_admin, false) = false
              AND COALESCE(u.points, 0) >= 1000
              AND NOT EXISTS (
                SELECT 1
                FROM transactions t
                WHERE t.user_id = u.id
                  AND t.type = ANY($1)
              )
            ORDER BY u.created_at ASC
          `,
          [rewardTypesThatShouldExistForRealPoints],
        ),
        client.query<DailySigninRow>(
          `
            SELECT
              t.user_id,
              u.username,
              u.points,
              ARRAY_AGG(t.id ORDER BY t.created_at ASC, t.id ASC) AS tx_ids,
              SUM((t.amount::numeric - $1::numeric))::text AS correction_amount
            FROM transactions t
            INNER JOIN users u
              ON u.id = t.user_id
            WHERE t.type = 'daily_signin'
              AND t.status = 'completed'
              AND t.amount::numeric > $1::numeric
            GROUP BY t.user_id, u.username, u.points
            ORDER BY MIN(t.created_at) ASC
          `,
          [String(DAILY_SIGNIN_TARGET)],
        ),
        client.query<DuplicateReferralRow>(
          `
            SELECT
              t.user_id,
              u.username,
              u.points,
              ARRAY_AGG(t.id ORDER BY t.created_at ASC, t.id ASC) AS tx_ids,
              SUM(t.amount::numeric)::text AS correction_amount
            FROM transactions t
            INNER JOIN users u
              ON u.id = t.user_id
            WHERE t.type = 'referral_bonus'
              AND t.status = 'completed'
              AND t.description LIKE 'Referral bonus for %'
            GROUP BY t.user_id, u.username, u.points
            ORDER BY MIN(t.created_at) ASC
          `,
        ),
      ]);

    const correctionsByUser = new Map<string, UserCorrection>();

    for (const row of legacyDefaultRows.rows) {
      const entry = getOrCreateUserCorrection(
        correctionsByUser,
        row.user_id,
        row.username,
        Number(row.points || 0),
      );
      entry.categories.push({
        kind: "legacy_default",
        amount: LEGACY_DEFAULT_EXCESS,
        description: `Legacy default BantCredit correction (${LEGACY_DEFAULT_POINTS} -> ${CURRENT_SIGNUP_REWARD})`,
      });
    }

    for (const row of dailySigninRows.rows) {
      const correctionAmount = Math.round(toAmount(row.correction_amount));
      if (correctionAmount <= 0) continue;
      const entry = getOrCreateUserCorrection(
        correctionsByUser,
        row.user_id,
        row.username,
        Number(row.points || 0),
      );
      entry.categories.push({
        kind: "daily_signin",
        amount: correctionAmount,
        description: `Legacy daily sign-in correction for txs: ${row.tx_ids.join(",")}`,
      });
    }

    for (const row of duplicateReferralRows.rows) {
      const correctionAmount = Math.round(toAmount(row.correction_amount));
      if (correctionAmount <= 0) continue;
      const entry = getOrCreateUserCorrection(
        correctionsByUser,
        row.user_id,
        row.username,
        Number(row.points || 0),
      );
      entry.categories.push({
        kind: "duplicate_referral",
        amount: correctionAmount,
        description: `Legacy duplicate referral bonus correction for txs: ${row.tx_ids.join(",")}`,
      });
    }

    const correctionUserIds = Array.from(correctionsByUser.keys());
    const correctionDescriptions = Array.from(
      new Set(
        Array.from(correctionsByUser.values()).flatMap((entry) =>
          entry.categories.map((category) => category.description),
        ),
      ),
    );

    if (correctionUserIds.length > 0 && correctionDescriptions.length > 0) {
      const existingCorrections = await client.query<{
        user_id: string;
        description: string;
      }>(
        `
          SELECT user_id, description
          FROM transactions
          WHERE user_id = ANY($1)
            AND type = 'bantcredit_correction'
            AND description = ANY($2)
        `,
        [correctionUserIds, correctionDescriptions],
      );

      const appliedCorrectionKeys = new Set(
        existingCorrections.rows.map(
          (row) => `${row.user_id}::${row.description}`,
        ),
      );

      for (const entry of correctionsByUser.values()) {
        entry.categories = entry.categories.filter(
          (category) =>
            !appliedCorrectionKeys.has(
              `${entry.userId}::${category.description}`,
            ),
        );
      }
    }

    const affectedUsers = Array.from(correctionsByUser.values())
      .filter((entry) => entry.categories.length > 0)
      .map((entry) => ({
        ...entry,
        totalCorrection: entry.categories.reduce((sum, category) => sum + category.amount, 0),
        projectedPoints: Math.max(
          0,
          entry.currentPoints -
            entry.categories.reduce((sum, category) => sum + category.amount, 0),
        ),
      }))
      .sort((left, right) => right.totalCorrection - left.totalCorrection);

    console.log(
      JSON.stringify(
        {
          applyMode: APPLY,
          topUsersWith1000PlusBantCredit: topPointsRows.rows,
          legacyDefaultUsers: legacyDefaultRows.rows.length,
          oversizedDailySigninUsers: dailySigninRows.rows.length,
          duplicateReferralUsers: duplicateReferralRows.rows.length,
          affectedUsers,
        },
        null,
        2,
      ),
    );

    if (!APPLY) {
      console.log(
        "\nDry run only. Re-run with APPLY=true to write correction transactions and adjust points.",
      );
      return;
    }

    await client.query("BEGIN");

    let correctedUsers = 0;

    for (const user of affectedUsers) {
      let totalAppliedCorrection = 0;

      for (const category of user.categories) {
        const existingCorrection = await client.query(
          `
            SELECT id
            FROM transactions
            WHERE user_id = $1
              AND type = 'bantcredit_correction'
              AND description = $2
            LIMIT 1
          `,
          [user.userId, category.description],
        );

        if ((existingCorrection.rowCount || 0) > 0) {
          continue;
        }

        const correctionAmount = Math.round(category.amount);
        if (correctionAmount <= 0) continue;

        await client.query(
          `
            INSERT INTO transactions (user_id, type, amount, description, status, created_at)
            VALUES ($1, 'bantcredit_correction', $2, $3, 'completed', NOW())
          `,
          [user.userId, String(-correctionAmount), category.description],
        );

        totalAppliedCorrection += correctionAmount;
      }

      if (totalAppliedCorrection <= 0) {
        continue;
      }

      await client.query(
        `
          UPDATE users
          SET
            points = GREATEST(COALESCE(points, 0) - $2::integer, 0),
            updated_at = NOW()
          WHERE id = $1
        `,
        [user.userId, totalAppliedCorrection],
      );

      correctedUsers += 1;
    }

    await client.query("COMMIT");

    console.log(
      `\nApplied BantCredit legacy corrections for ${correctedUsers} user(s).`,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
