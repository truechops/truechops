import { configureStore } from '@reduxjs/toolkit';
import realmReducer from './realm-app';
import navReducer from './navigation';
import scoreReducer, { scoreActions } from './score';
import scoreAuxReducer from './scoreAux';
import undoable, { excludeAction } from 'redux-undo';

const { toggleIsPlaying, selectNote, setRepeatStart, setRepeatEnd } = scoreActions;

const store = configureStore({
    reducer: {
        realm: realmReducer,
        nav: navReducer,
        score: undoable(scoreReducer, { 
            filter: excludeAction([toggleIsPlaying.type, selectNote.type, 
                                   setRepeatStart.type, setRepeatEnd.type])
        }),
        scoreAux: scoreAuxReducer
    }
})

export default store;