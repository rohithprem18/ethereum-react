interface User {
  username: string;
  password: string;
  name: string;
  panCard: string;
  annualIncome: number;
  phoneNumber: string;
  tradeCount: number;
}

class UserService {
  private readonly USERS_KEY = 'eth_trading_users';
  private readonly CURRENT_USER_KEY = 'eth_trading_current_user';

  getUsers(): User[] {
    const users = localStorage.getItem(this.USERS_KEY);
    return users ? JSON.parse(users) : [];
  }

  saveUser(user: User): void {
    const users = this.getUsers();
    users.push(user);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  getCurrentUser(): User | null {
    const user = localStorage.getItem(this.CURRENT_USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  setCurrentUser(user: User): void {
    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
  }

  clearCurrentUser(): void {
    localStorage.removeItem(this.CURRENT_USER_KEY);
  }

  updateUser(username: string, updates: Partial<User>): void {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updates };
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
      
      // Update current user if it's the same user
      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.username === username) {
        this.setCurrentUser(users[userIndex]);
      }
    }
  }

  validateLogin(username: string, password: string): User | null {
    const users = this.getUsers();
    return users.find(u => u.username === username && u.password === password) || null;
  }
}

export const userService = new UserService(); 