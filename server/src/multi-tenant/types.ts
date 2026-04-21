import { Pool, PoolClient, QueryResult } from 'pg';

export interface TenantDb {
  query(text: string, params?: any[]): Promise<QueryResult>;
  getClient(): Promise<PoolClient>;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  db_name: string;
  db_host: string;
  db_port: number;
  status: string;
}

export interface SuperAdminJwtPayload {
  adminId: number;
  email: string;
  role: 'super_admin';
  impersonatingTenant?: string;
}
