import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { scoreActions } from "../../store/score";
import { useRouter } from "next/router";
import { useLazyQuery, useReactiveVar } from "@apollo/client";
import { GET_ALL_USER_RHYTHMS_QUERY } from "../../../data/graphql";
import { userRhythmsVar } from "../../graphql/cache";
import { CircularProgress } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";

import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import Paper from "@material-ui/core/Paper";

export default function Main() {
  const currentUser = useSelector((state) => state.realm.currentUser);
  const router = useRouter();

  //Don't allow the user to visit this page if they are not logged in.
  if(!currentUser) {
    router.push('/');
  }

  const dispatch = useDispatch();
  
  const userRhythms = useReactiveVar(userRhythmsVar);
  
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
      color: 'black'
    }
  }));

  const classes = useStyles();

  const [getUserRhythms, { data: userRhythmsData }] = useLazyQuery(
    GET_ALL_USER_RHYTHMS_QUERY
  );

  if (userRhythmsData) {
    userRhythmsVar(userRhythmsData["rhythms"]);
  }

  useEffect(() => {
    if(currentUser) {
      getUserRhythms({ variables: { userId: currentUser.id } });
    }
    
  }, [getUserRhythms, currentUser]);

  function practiceRhythm(score) {
    const omitTypename = (key, value) =>
      key === "__typename" ? undefined : value;
    const scrubbedScore = JSON.parse(JSON.stringify(score), omitTypename);
    dispatch(scoreActions.updateScore(scrubbedScore));
    router.push("/");
  }

  return (
    <section style={{ textAlign: "center" }}>
      {userRhythms.length > 0 && (
        
          <List>
            {userRhythms.map((rhythm, rhythmIndex) => (
              <Paper key={`rhythm-${rhythmIndex}`} className={classes.root}>
                <ListItem className={classes.listItem} onClick={practiceRhythm.bind(null, rhythm.score)}>
                  <ListItemText
                  secondaryTypographyProps={{ style: {
                    color: 'black'
                  } }} 
                    primary={rhythm.name}
                    secondary={new Date(rhythm.date).toLocaleString("en-US", {
                      day: "numeric", // numeric, 2-digit
                      year: "numeric", // numeric, 2-digit
                      month: "long", // numeric, 2-digit, long, short, nar
                    })}
                  />
                </ListItem>
              </Paper>
            ))}
          </List>
      )}

      {userRhythms.length === 0 && <CircularProgress />}
    </section>
  );
}
