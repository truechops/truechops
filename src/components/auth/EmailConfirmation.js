import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { login } from "../../store/realm-app";
import { useRouter } from "next/router";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles } from "@material-ui/styles";

export default function EmailConfirmation(props) {
  const app = useSelector((state) => state.realm.app);
  const dispatch = useDispatch();
  const router = useRouter();

  const useStyles = makeStyles(theme => ({
    topQuarterCentered: {
      position: "fixed",
      top: "25%",
      left: "50%",
    }
  }));

  const classes = useStyles();

  useEffect(() => {
    const confirmUser = async () => {
      await app.emailPasswordAuth.confirmUser(props.token, props.tokenId);
      router.push("/login");
    };

    confirmUser();
  }, [app, dispatch, login]);

  return <CircularProgress className={classes.topQuarterCentered} color="primary" />;
}

export async function getServerSideProps({ query }) {
  const token = query.token ?? '';
  const tokenId = query.tokenId ?? '';

  return { props: { token, tokenId } };
}
