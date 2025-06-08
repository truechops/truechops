import { useState  } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as Realm from "realm-web";
import { login } from "../../store/realm-app";
import useAuthStyles from "./auth-styles";
import useAuthFormHook from "./auth-form-hook";
import useRouter from "next/router";
import CircularProgress from "@mui/material/CircularProgress";
import { appActions } from "../../store/app";

export default function Login() {
  const dispatch = useDispatch();

  // Keep track of input validation/errors
  const [error, setError] = useState({});
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loginHandler = async (email, password) => {
    setIsLoggingIn(true);
    try {
      dispatch(login(Realm.Credentials.emailPassword(email, password)));
    } catch (err) {
      //handleAuthenticationError(err, setError);
    }
    useRouter.push("/");
  };

  const { form } = useAuthFormHook({
    isSignUp: false,
    onSubmitHandler: loginHandler,
    error,
    setError,
    facebookText: "Log In With Facebook",
    googleText: "Log In With Google",
    emailHeading: 'Log In by E-mail',
    continueText: 'Log In'
  });

  dispatch(appActions.setPageLoaded());

  const classes = useAuthStyles();
  return (
    <>
      {isLoggingIn && (
        <CircularProgress className={classes.centeredTopQuarter} />
      )}
      {!isLoggingIn && form}
    </>
  );
}
