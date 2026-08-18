-- NO_TRANSACTION

-- Add 'hr' to the app_role enum type
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'hr';
