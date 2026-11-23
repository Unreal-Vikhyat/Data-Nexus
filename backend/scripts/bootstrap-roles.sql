\set ON_ERROR_STOP on
-- Supply passwords with psql -v migrator_password=... -v app_password=...
CREATE ROLE nexus_migrator LOGIN PASSWORD :'migrator_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE nexus_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT CONNECT ON DATABASE data_nexus TO nexus_migrator, nexus_app;
GRANT CREATE ON DATABASE data_nexus TO nexus_migrator;
