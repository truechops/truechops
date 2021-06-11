import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as Realm from "realm-web";
import { login } from "../../store/realm-app";
import DividerWithText from "../../ui/DividerWithText";
import useAuthStyles from "./auth-styles";
import SocialButtons from "./SocialButtons";
import useAuthFormHook from "./auth-form-hook";
import useRouter from "next/router";
import CircularProgress from "@material-ui/core/CircularProgress";

export default function Login() {
  const dispatch = useDispatch();
  const app = useSelector((state) => state.realm.app);

  // Keep track of input validation/errors
  const [error, setError] = useState({});
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loginHandler = async (email, password) => {
    setIsLoggingIn(true);
    try {
      dispatch(login(Realm.Credentials.emailPassword(email, password)));
    } catch (err) {
      handleAuthenticationError(err, setError);
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
    emailHeading: 'Log In by E-mail'
  });

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
