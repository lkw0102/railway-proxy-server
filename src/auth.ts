import { UsernamePasswordCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';

export class AuthProvider {
    private credential: UsernamePasswordCredential;

    constructor() {
        if (!process.env.TENANT_ID || !process.env.CLIENT_ID || !process.env.PROXY_USERNAME || !process.env.PROXY_PASSWORD) {
            throw new Error('缺少必要的環境變數: TENANT_ID, CLIENT_ID, PROXY_USERNAME, PROXY_PASSWORD');
        }

        this.credential = new UsernamePasswordCredential(
            process.env.TENANT_ID,
            process.env.CLIENT_ID,
            process.env.PROXY_USERNAME,
            process.env.PROXY_PASSWORD
        );
    }

    async getAccessToken(): Promise<string> {
        const scopes = [
            'https://graph.microsoft.com/Files.Read.All',
            'https://graph.microsoft.com/Sites.Read.All'
        ];
        const response = await this.credential.getToken(scopes);
        return response?.token || '';
    }

    async getGraphClient(): Promise<Client> {
        const token = await this.getAccessToken();
        return Client.init({
            authProvider: (done) => {
                done(null, token);
            }
        });
    }
}

import { Client } from '@microsoft/microsoft-graph-client';

export class AuthProvider {
    private credential: UsernamePasswordCredential;

    constructor() {
        if (!process.env.TENANT_ID || !process.env.CLIENT_ID || !process.env.PROXY_USERNAME || !process.env.PROXY_PASSWORD) {
            throw new Error('缺少必要的環境變數: TENANT_ID, CLIENT_ID, PROXY_USERNAME, PROXY_PASSWORD');
        }

        this.credential = new UsernamePasswordCredential(
            process.env.TENANT_ID,
            process.env.CLIENT_ID,
            process.env.PROXY_USERNAME,
            process.env.PROXY_PASSWORD
        );
    }

    async getAccessToken(): Promise<string> {
        const scopes = [
            'https://graph.microsoft.com/Files.Read.All',
            'https://graph.microsoft.com/Sites.Read.All'
        ];
        const response = await this.credential.getToken(scopes);
        return response?.token || '';
    }

    async getGraphClient(): Promise<Client> {
        const token = await this.getAccessToken();
        return Client.init({
            authProvider: (done) => {
                done(null, token);
            }
        });
    }
}
