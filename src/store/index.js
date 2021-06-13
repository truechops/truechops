import {configureStore} from '@reduxjs/toolkit';
import realmReducer from './realm-app';
import navReducer from './navigation';

const store = configureStore({
    reducer: {
        realm: realmReducer,
        nav: navReducer
    }
})

export default store;