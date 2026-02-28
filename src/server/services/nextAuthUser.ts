// Stub for NextAuth user service (not implemented in this deployment)
export class NextAuthUserService {
  constructor(_db: any) {}

  async createAuthenticator(_data: any) { return null; }
  async createSession(_data: any) { return null; }
  async createUser(_data: any) { return null; }
  async createVerificationToken(_data: any) { return null; }
  async deleteSession(_data: any) { return null; }
  async deleteUser(_data: any) { return null; }
  async getAccount(_providerAccountId: any, _provider: any) { return null; }
  async getAuthenticator(_data: any) { return null; }
  async getSessionAndUser(_data: any) { return null; }
  async getUser(_data: any) { return null; }
  async getUserByAccount(_data: any) { return null; }
  async getUserByEmail(_data: any) { return null; }
  async linkAccount(_data: any) { return null; }
  async listAuthenticatorsByUserId(_data: any) { return []; }
  async unlinkAccount(_data: any) { return null; }
  async updateAuthenticatorCounter(_credentialID: any, _counter: any) { return null; }
  async updateSession(_data: any) { return null; }
  async updateUser(_data: any) { return null; }
  async useVerificationToken(_data: any) { return null; }
}
