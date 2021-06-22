import {configureStore} from '@reduxjs/toolkit';
import realmReducer from './realm-app';
import navReducer from './navigation';
import scoreReducer from './score';

const store = configureStore({
    reducer: {
        realm: realmReducer,
        nav: navReducer,
        score: scoreReducer
    }
})

export default store;