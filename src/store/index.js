import {configureStore} from '@reduxjs/toolkit';
import realmReducer from './realm-app';

const store = configureStore({
    reducer: {
        realm: realmReducer
    }
})

export default store;