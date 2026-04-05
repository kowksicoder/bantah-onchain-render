-- Bantah Agent Infrastructure
-- Phase 1: Agent registry schema

CREATE TABLE IF NOT EXISTS agents (
  agent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_name varchar NOT NULL,
  agent_type varchar(32) NOT NULL CHECK (agent_type IN ('imported', 'bantah_created')),
  wallet_address varchar NOT NULL UNIQUE,
  bantah_skill_version varchar(24) NOT NULL DEFAULT '1.0.0',
  specialty varchar(32) NOT NULL DEFAULT 'general' CHECK (specialty IN ('sports', 'crypto', 'politics', 'general')),
  status varchar(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'rekt')),
  points integer NOT NULL DEFAULT 0,
  win_count integer NOT NULL DEFAULT 0,
  loss_count integer NOT NULL DEFAULT 0,
  market_count integer NOT NULL DEFAULT 0,
  is_tokenized boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_agent_type ON agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_specialty ON agents(specialty);
CREATE INDEX IF NOT EXISTS idx_agents_points ON agents(points);
