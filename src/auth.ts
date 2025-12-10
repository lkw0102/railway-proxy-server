import { UsernamePasswordCredential, ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';

export class AuthProvider {
    private credential: UsernamePasswordCredential | ClientSecretCredential | null = null;
    private isClientSecretAuth: boolean = false;

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
                this.isClientSecretAuth = true;
            } else if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
                // 回退到 UsernamePasswordCredential（需要應用程式設定為公開客戶端）
                console.log('使用 UsernamePasswordCredential 認證（需要應用程式設定為公開客戶端）');
                this.credential = new UsernamePasswordCredential(
                    process.env.TENANT_ID,
                    process.env.CLIENT_ID,
                    process.env.PROXY_USERNAME,
                    process.env.PROXY_PASSWORD
                );
                this.isClientSecretAuth = false;
            } else {
                throw new Error('缺少認證資訊: 請設定 CLIENT_SECRET 或 PROXY_USERNAME + PROXY_PASSWORD');
            }
        }
        return this.credential;
    }

    async getAccessToken(): Promise<string> {
        try {
            const credential = this.getCredential();
            
            // Client Secret Credential（應用程式認證流程）必須使用 /.default 格式
            // UsernamePasswordCredential（委派認證流程）可以使用具體的權限範圍
            const scopes = this.isClientSecretAuth
                ? ['https://graph.microsoft.com/.default']  // 應用程式認證流程
                : [  // 委派認證流程
                    'https://graph.microsoft.com/Files.Read.All',
                    'https://graph.microsoft.com/Sites.Read.All'
                ];
            
            console.log(`取得存取權杖，認證類型: ${this.isClientSecretAuth ? 'Client Secret' : 'Username/Password'}`);
            console.log(`Scope: ${scopes.join(', ')}`);
            
            const response = await credential.getToken(scopes);
            
            if (!response || !response.token) {
                throw new Error('無法取得存取權杖：回應為空');
            }
            
            console.log('成功取得存取權杖');
            return response.token;
        } catch (error: any) {
            console.error('取得存取權杖時發生錯誤:', error);
            console.error('錯誤詳情:', {
                message: error?.message,
                name: error?.name,
                code: error?.code,
                statusCode: error?.statusCode,
                errorCode: error?.errorCode,
                errorDescription: error?.errorDescription
            });
            
            // 提供更詳細的錯誤訊息
            if (error?.message) {
                throw new Error(`認證失敗: ${error.message}`);
            } else if (error?.errorCode) {
                throw new Error(`認證失敗 (${error.errorCode}): ${error.errorDescription || '未知錯誤'}`);
            } else {
                throw new Error(`認證失敗: ${JSON.stringify(error)}`);
            }
        }
    }

    async getGraphClient(): Promise<Client> {
        try {
            const token = await this.getAccessToken();
            return Client.init({
                authProvider: (done) => {
                    done(null, token);
                }
            });
        } catch (error: any) {
            console.error('建立 Graph Client 時發生錯誤:', error);
            throw new Error(`無法建立 Graph Client: ${error.message || '未知錯誤'}`);
        }
    }
}

