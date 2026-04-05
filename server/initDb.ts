import { readFileSync } from 'fs';
import { pool } from './db';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initializeDatabase() {
  try {
    // Read the migration file
    const migrationPath = path.resolve(__dirname, '../migrations/0000_gray_harrier.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    // Split statements by the drizzle-kit statement separator
    const statements = sql.split('--> statement-breakpoint').filter(s => s.trim());
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;
      
      try {
        const result = await pool.query(statement);
        successCount++;
      } catch (error: any) {
        // Ignore "already exists" errors (42P07) and other benign errors
        if (error.code === '42P07' || error.code === '42P06') {
          skipCount++;
        } else if (error.message?.includes('already exists')) {
          skipCount++;
        } else {
          errorCount++;
          console.error(`✗ Statement ${i + 1} FAILED:`, error.message?.substring(0, 100));
          console.error(`   SQL: ${statement.substring(0, 80).replace(/\n/g, ' ')}...`);
        }
      }
    }

    // Ensure onchain columns exist in shared tables (safe to run repeatedly)
    const onchainStatements = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_wallet_address varchar`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_addresses jsonb DEFAULT '[]'::jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_users_primary_wallet_address ON users(primary_wallet_address)`,
      `CREATE TABLE IF NOT EXISTS agents (
        agent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agent_name varchar NOT NULL,
        agent_type varchar(32) NOT NULL,
        wallet_address varchar NOT NULL UNIQUE,
        endpoint_url varchar(512) NOT NULL UNIQUE,
        bantah_skill_version varchar(24) NOT NULL DEFAULT '1.0.0',
        specialty varchar(32) NOT NULL DEFAULT 'general',
        status varchar(32) NOT NULL DEFAULT 'active',
        skill_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
        wallet_network_id varchar(64),
        wallet_provider varchar(64),
        owner_wallet_address varchar,
        wallet_data jsonb,
        runtime_engine varchar(32),
        runtime_status varchar(32),
        runtime_config jsonb,
        points integer NOT NULL DEFAULT 0,
        win_count integer NOT NULL DEFAULT 0,
        loss_count integer NOT NULL DEFAULT 0,
        market_count integer NOT NULL DEFAULT 0,
        is_tokenized boolean NOT NULL DEFAULT false,
        last_skill_check_at timestamp,
        last_skill_check_score integer,
        last_skill_check_status varchar(16),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS endpoint_url varchar(512)`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_skill_check_at timestamp`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_skill_check_score integer`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_skill_check_status varchar(16)`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS skill_actions jsonb DEFAULT '[]'::jsonb`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_network_id varchar(64)`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_provider varchar(64)`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_wallet_address varchar`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_data jsonb`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS runtime_engine varchar(32)`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS runtime_status varchar(32)`,
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS runtime_config jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON agents(owner_id)`,
      `CREATE INDEX IF NOT EXISTS idx_agents_agent_type ON agents(agent_type)`,
      `CREATE INDEX IF NOT EXISTS idx_agents_endpoint_url ON agents(endpoint_url)`,
      `CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)`,
      `CREATE INDEX IF NOT EXISTS idx_agents_specialty ON agents(specialty)`,
      `CREATE INDEX IF NOT EXISTS idx_agents_points ON agents(points)`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS settlement_rail varchar DEFAULT 'offchain'`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS chain_id integer`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS token_symbol varchar`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS token_address varchar`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenged_wallet_address varchar`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS creator_type varchar(16) DEFAULT 'human'`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenger_type varchar(16) DEFAULT 'human'`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenged_type varchar(16) DEFAULT 'human'`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS creator_agent_id uuid`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenger_agent_id uuid`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenged_agent_id uuid`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS created_by_agent boolean DEFAULT false`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS agent_involved boolean DEFAULT false`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS stake_atomic varchar`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS decimals integer`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS escrow_tx_hash varchar`,
      `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS settle_tx_hash varchar`,
      `CREATE INDEX IF NOT EXISTS idx_challenges_settlement_rail ON challenges(settlement_rail)`,
      `CREATE INDEX IF NOT EXISTS idx_challenges_chain_id ON challenges(chain_id)`,
      `CREATE INDEX IF NOT EXISTS idx_challenges_challenged_wallet_address ON challenges(challenged_wallet_address)`,
      `CREATE INDEX IF NOT EXISTS idx_challenges_creator_agent_id ON challenges(creator_agent_id)`,
      `CREATE INDEX IF NOT EXISTS idx_challenges_challenger_agent_id ON challenges(challenger_agent_id)`,
      `CREATE INDEX IF NOT EXISTS idx_challenges_challenged_agent_id ON challenges(challenged_agent_id)`,
      `CREATE INDEX IF NOT EXISTS idx_challenges_agent_involved ON challenges(agent_involved)`,
      `ALTER TABLE pair_queue ADD COLUMN IF NOT EXISTS participant_type varchar(16) DEFAULT 'human'`,
      `ALTER TABLE pair_queue ADD COLUMN IF NOT EXISTS agent_id uuid`,
      `CREATE INDEX IF NOT EXISTS idx_pair_queue_agent_id ON pair_queue(agent_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pair_queue_participant_type ON pair_queue(participant_type)`,
      `CREATE TABLE IF NOT EXISTS onchain_challenge_metadata (
        metadata_hash varchar primary key,
        chain_id integer,
        escrow_tx_hash varchar,
        challenge_id integer,
        payload jsonb not null,
        created_at timestamp default now(),
        updated_at timestamp default now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_onchain_metadata_escrow_tx_hash ON onchain_challenge_metadata(escrow_tx_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_onchain_metadata_challenge_id ON onchain_challenge_metadata(challenge_id)`,
      `CREATE TABLE IF NOT EXISTS onchain_indexer_state (
        chain_id integer primary key,
        last_block bigint not null,
        updated_at timestamp default now()
      )`,
    ];

    for (const statement of onchainStatements) {
      try {
        await pool.query(statement);
      } catch (error: any) {
        // Ignore if target table is missing in an older boot sequence
        if (error.code === '42P01') {
          continue;
        }
        console.error(`✗ Onchain schema statement FAILED: ${statement.substring(0, 90)}...`);
        console.error(`   ${error.message?.substring(0, 120)}`);
      }
    }
    
    return true;
  } catch (error: any) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
}
