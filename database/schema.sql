-- Users table to store player information
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  photo_url TEXT,
  language_code VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table to store player wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  address VARCHAR(42) NOT NULL,
  seed_phrase TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Inventory table to store player resources
CREATE TABLE inventories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  snot DECIMAL(20, 8) DEFAULT 0,
  snot_coins DECIMAL(20, 8) DEFAULT 0,
  container_capacity_level INTEGER DEFAULT 1,
  filling_speed_level INTEGER DEFAULT 1,
  collection_efficiency DECIMAL(5, 2) DEFAULT 1.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Game progress table
CREATE TABLE game_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  container_level INTEGER DEFAULT 1,
  container_snot DECIMAL(20, 8) DEFAULT 0,
  energy INTEGER DEFAULT 100,
  max_energy INTEGER DEFAULT 100,
  fusion_games_played INTEGER DEFAULT 0,
  fusion_attempts_used INTEGER DEFAULT 0,
  last_fusion_game_time TIMESTAMP WITH TIME ZONE,
  highest_level INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Achievements table
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  required_value INTEGER DEFAULT 0,
  category VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Player achievements
CREATE TABLE player_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_id)
);

-- Transactions table for tracking resource changes
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_player_achievements_user_id ON player_achievements(user_id);
CREATE INDEX idx_game_progress_user_id ON game_progress(user_id);
CREATE INDEX idx_inventories_user_id ON inventories(user_id);

-- Insert some default achievements
INSERT INTO achievements (name, description, required_value, category) VALUES
('First Snot', 'Collect your first SNOT', 1, 'collection'),
('Snot Master', 'Collect 1,000 SNOT', 1000, 'collection'),
('Fusion Beginner', 'Complete your first fusion game', 1, 'fusion'),
('Storage Upgrade', 'Upgrade your storage container', 2, 'storage'),
('Coin Collector', 'Collect 100 SnotCoins', 100, 'collection');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_inventories_updated_at
  BEFORE UPDATE ON inventories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_progress_updated_at
  BEFORE UPDATE ON game_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

