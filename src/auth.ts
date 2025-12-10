import { UsernamePasswordCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';

export class AuthProvider {
    private credential: UsernamePasswordCredential | null = null;

    private getCredential(): UsernamePasswordCredential {
        if (!this.credential) {
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
        return this.credential;
    }

    async getAccessToken(): Promise<string> {
        const credential = this.getCredential();
        const scopes = [
            'https://graph.microsoft.com/Files.Read.All',
            'https://graph.microsoft.com/Sites.Read.All'
        ];
        const response = await credential.getToken(scopes);
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
