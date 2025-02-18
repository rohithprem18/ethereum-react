import { useState, useEffect } from 'react';
import { userService } from '../services/userService';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(userService.getCurrentUser());

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = userService.getCurrentUser();
    if (storedUser) {
      setCurrentUser(storedUser);
    }
  }, []);

  const register = (userData: {
    username: string;
    password: string;
    name: string;
    panCard: string;
    annualIncome: number;
    phoneNumber: string;
  }) => {
    const users = userService.getUsers();
    if (users.some(u => u.username === userData.username)) {
      throw new Error('Username already exists');
    }

    const newUser = {
      ...userData,
      tradeCount: 0
    };

    userService.saveUser(newUser);
    userService.setCurrentUser(newUser);
    setCurrentUser(newUser);
  };

  const login = (username: string, password: string) => {
    const user = userService.validateLogin(username, password);
    if (!user) {
      throw new Error('Invalid username or password');
    }
    userService.setCurrentUser(user);
    setCurrentUser(user);
  };

  const logout = () => {
    userService.clearCurrentUser();
    setCurrentUser(null);
  };

  const updateUserTradeCount = (username: string) => {
    const user = userService.getCurrentUser();
    if (user && user.username === username) {
      userService.updateUser(username, {
        tradeCount: user.tradeCount + 1
      });
      setCurrentUser({
        ...user,
        tradeCount: user.tradeCount + 1
      });
    }
  };

  return {
    currentUser,
    register,
    login,
    logout,
    updateUserTradeCount
  };
}