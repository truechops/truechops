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
  const dispatch = useDispatch();
  const router = useRouter();
  const userRhythms = useReactiveVar(userRhythmsVar);
  const currentUser = useSelector((state) => state.realm.currentUser);

  const useStyles = makeStyles((theme) => ({
    root: {
      width: "100%",
      maxWidth: 360,
      margin: "auto",
      backgroundColor: theme.palette.background.paper,
    },
    listItem: {
      cursor: "pointer",
    },
  }));

  const classes = useStyles();

  const [getUserRhythms, { data: userRhythmsData }] = useLazyQuery(
    GET_ALL_USER_RHYTHMS_QUERY
  );

  if (userRhythmsData) {
    userRhythmsVar(userRhythmsData["rhythms"]);
  }

  useEffect(() => {
    getUserRhythms({ variables: { userId: currentUser.id } });
  }, [getUserRhythms, currentUser.id]);

  function practiceRhythm(score) {
    const omitTypename = (key, value) =>
      key === "__typename" ? undefined : value;
    const scrubbedScore = JSON.parse(JSON.stringify(score), omitTypename);
    dispatch(scoreActions.updateScore(scrubbedScore));
    router.push("/");
  }

  return (
    <section style={{ textAlign: "center" }}>
      <h1>My Rhythms</h1>

      {userRhythms.length > 0 && (
        <Paper className={classes.root}>
          <List>
            {userRhythms.map((rhythm) => (
              <>
                <ListItem className={classes.listItem} onClick={practiceRhythm.bind(null, rhythm.score)}>
                  <ListItemText
                    primary={rhythm.name}
                    secondary={new Date(rhythm.date).toLocaleString("en-US", {
                      day: "numeric", // numeric, 2-digit
                      year: "numeric", // numeric, 2-digit
                      month: "long", // numeric, 2-digit, long, short, nar
                    })}
                  />
                </ListItem>
              </>
            ))}
          </List>
        </Paper>
      )}

      {userRhythms.length === 0 && <CircularProgress />}
    </section>
  );
}
