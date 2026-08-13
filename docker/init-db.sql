-- Auto-create both dev and test databases upon Postgres container initialization
CREATE DATABASE jdconnect;
CREATE DATABASE jdconnect_test;

GRANT ALL PRIVILEGES ON DATABASE jdconnect TO jduser;
GRANT ALL PRIVILEGES ON DATABASE jdconnect_test TO jduser;
