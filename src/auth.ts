import { UsernamePasswordCredential, ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';

export class AuthProvider {
    private credential: UsernamePasswordCredential | ClientSecretCredential | null = null;

    private getCredential(): UsernamePasswordCredential | ClientSecretCredential {
        if (!this.credential) {
            if (!process.env.TENANT_ID || !process.env.CLIENT_ID) {
                throw new Error('缺少必要的環境變數: TENANT_ID, CLIENT_ID');
            }

            // 優先使用 Client Secret 認證（更安全，適合伺服器端）
            if (process.env.CLIENT_SECRET) {
                console.log('使用 Client Secret 認證');
                this.credential = new ClientSecretCredential(
                    process.env.TENANT_ID,
                    process.env.CLIENT_ID,
                    process.env.CLIENT_SECRET
                );
            } else if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
                // 回退到 UsernamePasswordCredential（需要應用程式設定為公開客戶端）
                console.log('使用 UsernamePasswordCredential 認證（需要應用程式設定為公開客戶端）');
                this.credential = new UsernamePasswordCredential(
                    process.env.TENANT_ID,
                    process.env.CLIENT_ID,
                    process.env.PROXY_USERNAME,
                    process.env.PROXY_PASSWORD
                );
            } else {
                throw new Error('缺少認證資訊: 請設定 CLIENT_SECRET 或 PROXY_USERNAME + PROXY_PASSWORD');
            }
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

