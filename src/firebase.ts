import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAOC-ZGm1uXG_EjPYYZw6to15rnVj_EfPE",
  authDomain: "ethereum-d3819.firebaseapp.com",
  databaseURL: "https://ethereum-d3819-default-rtdb.firebaseio.com",
  projectId: "ethereum-d3819",
  storageBucket: "ethereum-d3819.firebasestorage.app",
  messagingSenderId: "849785295839",
  appId: "1:849785295839:web:b6fa0f201ae7193d4f6a6a",
  measurementId: "G-JQ63B8HEF3"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);