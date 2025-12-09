import { createSlice } from '@reduxjs/toolkit';
import { jwtDecode } from 'jwt-decode';

const initialState = {
  isAuth: false,
  isAdmin: false,
  user: {
    id: '',
    phone: '',
    firstName: '',
    surname: '',
    type: '',
  },
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      const { token } = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      try {
        const decoded = jwtDecode(token);
        state.isAuth = true;
        state.isAdmin = decoded.type == 'Admin';
        state.user.id = decoded.id;
        state.user.email = decoded.email;
        state.user.phone = decoded.phone;
        state.user.firstName = decoded.firstName;
        state.user.surname = decoded.surname;
        state.user.type = decoded.type;
      } catch (e) {
        console.error('Помилка декодування токена:', e);
      }
    },
    logout: state => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
      state.isAuth = false;
      state.isAdmin = false;
      state.user.id = '';
      state.user.email = '';
      state.user.phone = '';
      state.user.firstName = '';
      state.user.surname = '';
      state.user.type = '';
    },
    initializeFromLocalStorage: state => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwtDecode(token);
          state.isAuth = true;
          state.isAdmin = decoded.type == 'Admin';
          state.user.id = decoded.id;
          state.user.email = decoded.email;
          state.user.phone = decoded.phone;
          state.user.firstName = decoded.firstName;
          state.user.surname = decoded.surname;
          state.user.type = decoded.type;
        } catch (e) {
          console.error('Помилка декодування токена:', e);
        }
      }
    },
  },
});

export const { setUser, logout, initializeFromLocalStorage } = authSlice.actions;
export default authSlice.reducer;
