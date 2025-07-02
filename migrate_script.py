#Migrates data from SQLite to PostGRE
#Rule: At first delete the datas from POST GRE tables, then migrate
import pandas as pd
from sqlalchemy import create_engine

# 1. Connect to SQLite
sqlite_engine = create_engine('sqlite:///instance/forum.db')

# 2. Connect to PostgreSQL
pg_engine = create_engine('postgresql://postgres:bdcom0061@localhost:5432/bdcom_dev_forum')

# 3. List of tables to migrate
tables = ['post', 'comment', 'post_like']

# 4. Migrate each table
for table in tables:
    print(f"Migrating table: {table}")
    df = pd.read_sql(f'SELECT * FROM {table}', sqlite_engine)
    df.to_sql(table, pg_engine, if_exists='append', index=False)
    print(f"✅ Table '{table}' migrated successfully.\n")
