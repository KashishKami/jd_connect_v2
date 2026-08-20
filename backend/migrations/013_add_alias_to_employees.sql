-- Add alias column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS alias TEXT;
