import { configureStore } from '@reduxjs/toolkit';
import realmReducer from './realm-app';
import appReducer from './app';
import scoreReducer, { scoreActions } from './score';
import undoable, { includeAction } from 'redux-undo';

//These are the only actions that should trigger undo/redo.
const includeActions = [scoreActions.toggleAccent, scoreActions.toggleFlam, scoreActions.toggleDiddle,
                       scoreActions.toggleCheese, scoreActions.toggleLeftSticking, scoreActions.toggleRightSticking,
                       scoreActions.addMeasure, scoreActions.deleteMeasure, scoreActions.modifyNote,
                       scoreActions.updateScore, scoreActions.togglePartEnabled, scoreActions.deletePart, scoreActions.addPart,
                    ].map(action => action.type);

const store = configureStore({
    reducer: {
        realm: realmReducer,
        app: appReducer,
        score: undoable(scoreReducer, { 
            filter: includeAction(includeActions)
        })
    }
})

export default store;