-- Auto-create test database upon Postgres container initialization
CREATE DATABASE jdconnect_test;

GRANT ALL PRIVILEGES ON DATABASE jdconnect TO jduser;
GRANT ALL PRIVILEGES ON DATABASE jdconnect_test TO jduser;
