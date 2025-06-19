import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { scoreActions } from "../../store/score";
import { useRouter } from "next/router";
import { useLazyQuery, useReactiveVar } from "@apollo/client";
import { GET_ALL_USER_SAVED_RHYTHMS_QUERY } from "../../consts/gql/graphql";
import { userRhythmsVar } from "../../graphql/cache";
import { Button, CircularProgress, ListItemSecondaryAction } from "@mui/material";
import { makeStyles } from "@mui/styles";

import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import { DEFAULT_TEMPO } from "../../consts/score";

import { scrubTypename } from "../../helpers/mongodb";
import { FaTrash } from "react-icons/fa";
import { useTheme } from "@mui/styles";
import Dialog from '../ui/Dialog';
import { appActions } from "../../store/app";

import useRhythmMutations from '../../graphql/rhythm/useRhythmMutations';

export default function Main() {
  const currentUser = useSelector((state) => state.realm.currentUser);
  const router = useRouter();
  const theme = useTheme();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [errorDeletingRhythmDialog, setErrorDeletingRhythmDialog] = useState(false);
  const [rhythmToDelete, setRhythmToDelete] = useState({name: '', id: ''});
  const { deleteRhythm } = useRhythmMutations();

  const [getUserRhythms, { data: userRhythmsData, refetch, loading }] = useLazyQuery(
    GET_ALL_USER_SAVED_RHYTHMS_QUERY
  );
  //Don't allow the user to visit this page if they are not logged in.
  if (!currentUser) {
    router.push("/");
  }

  async function deleteRhythmHandler() {
    const deletedRhythm = await deleteRhythm(rhythmToDelete.id);
    if(!deletedRhythm) {
      setErrorDeletingRhythmDialog(true);
    }
    setShowDeleteConfirmation(false);
    refetch();
  }

  const dispatch = useDispatch();

  let userRhythmsReactiveVar = useReactiveVar(userRhythmsVar);
  let userRhythms = userRhythmsReactiveVar.slice();

  const useStyles = makeStyles((theme) => ({
    root: {
      width: "100%",
      maxWidth: 360,
      margin: "auto",
      backgroundColor: theme.palette.background.paper,
    },
    listItem: {
      cursor: "pointer",
      margin: theme.spacing(1),
    },
    listItemText: {
      color: "black",
    }
  }));

  const classes = useStyles();

  if (userRhythmsData) {
    userRhythmsVar(userRhythmsData["rhythms"]);
  }

  useEffect(() => {
    if (currentUser) {
      getUserRhythms({ variables: { userId: currentUser.id } });
    }
  }, [getUserRhythms, currentUser]);

  function practiceRhythm(score, name, tempo, mutations) {
    const scrubbedScore = scrubTypename(score);
    dispatch(
      scoreActions.updateScore({ score: scrubbedScore, name, tempo, mutations })
    );
    router.push("/");
  }

  //The rhythms coming back from mongodb are in ascending order. This makes sure the saved
  //rhythms are in descending order.
  userRhythms.sort(() => -1);

  dispatch(appActions.setPageLoaded());

  return (
    <>
      <section style={{ 
        textAlign: "center"
       }}>
        {userRhythms.length > 0 && (
          <List>
            {userRhythms.map((rhythm, rhythmIndex) => (
              <Paper key={`rhythm-${rhythmIndex}`} className={classes.root}>
                <ListItem
                  className={classes.listItem}
                  onClick={practiceRhythm.bind(
                    null,
                    rhythm.score,
                    rhythm.name,
                    rhythm.tempo ?? DEFAULT_TEMPO,
                    rhythm.mutations
                  )}
                >
                  <ListItemText
                    secondaryTypographyProps={{
                      style: {
                        color: "black",
                      },
                    }}
                    primary={rhythm.name}
                    secondary={new Date(rhythm.date).toLocaleString("en-US", {
                      day: "numeric", // numeric, 2-digit
                      year: "numeric", // numeric, 2-digit
                      month: "long", // numeric, 2-digit, long, short, nar
                    })}
                  />
                  <ListItemSecondaryAction onClick={() => {
                    setRhythmToDelete({id: rhythm._id, name: rhythm.name});
                    setShowDeleteConfirmation(true);
                  }
                  }>
                  <button style={{border: 0, background: 'white', cursor: 'pointer'}}>
                    <FaTrash size={theme.compose.sidebar.icons.size} />
                  </button>
                  </ListItemSecondaryAction>
                </ListItem>
                
              </Paper>
            ))}
          </List>
        )}

        {userRhythms.length === 0 && loading && <CircularProgress style={{...theme.spinner}} />}
        {userRhythms.length === 0 && !loading && <div style={{...theme.spinner, marginLeft: -33}}>No Rhythms!</div>}
      </section>

      <Dialog
        onOk={deleteRhythmHandler}
        message={`Delete ${rhythmToDelete.name}?`}
        isOpen={showDeleteConfirmation}
        onCancel={() => setShowDeleteConfirmation(false)}
      />

      <Dialog
        onOk={() => setErrorDeletingRhythmDialog(false)}
        message={"Error deleting rhythm. Please try again later."}
        isOpen={errorDeletingRhythmDialog}
      />
    </>
  );
}
