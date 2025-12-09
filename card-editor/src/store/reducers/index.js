import { combineReducers } from 'redux';
import user from './user';

// Об'єднання ред'юсерів
const rootReducer = combineReducers({
  user: user,
});

export default rootReducer;
