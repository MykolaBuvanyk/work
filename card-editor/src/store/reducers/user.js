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
    company:''
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
        state.user.company = decoded.company;
      } catch (e) {
        console.error('Помилка декодування токена:', e);
      }
    },
    // Merge partial user info into store (used after profile updates)
    mergeUser: (state, action) => {
      const payload = action.payload || {};
      try {
        state.user = {
          ...state.user,
          ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
          ...(payload.surname !== undefined ? { surname: payload.surname } : {}),
          ...(payload.email !== undefined ? { email: payload.email } : {}),
          ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
          ...(payload.company !== undefined ? { company: payload.company } : {}),
        };
      } catch (e) {
        console.error('mergeUser failed', e);
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
      state.user.company = '';
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
          state.user.company = decoded.company;
        } catch (e) {
          console.error('Помилка декодування токена:', e);
        }
      }
    },
  },
});

export const { setUser, logout, initializeFromLocalStorage, mergeUser } = authSlice.actions;
export default authSlice.reducer;
