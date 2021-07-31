import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import useAuthStyles from "./auth-styles";
import useAuthFormHook from "./auth-form-hook";
import CircularProgress from "@material-ui/core/CircularProgress";
import { appActions } from '../../store/app';

export default function SignUp() {
  const app = useSelector((state) => state.realm.app);
  const [emailSent, setEmailSent] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState({});
  const dispatch = useDispatch();

  const onSubmitEmailAuthHandler = async (
    firstName,
    lastName,
    email,
    password
  ) => {
    setIsRegistering(true);
    //I think e-mail validation is being automaticaly done through the Material-UI
    //via the 'e-mail' TextField type.
    if (password.length < 6 || password.length > 128) {
      setError((state) => ({
        ...state,
        password: "Password must be between 6 and 128 characters.",
      }));
      setIsRegistering(false);
      return;
    }

    await handleRegistrationAndLogin(email, password);
    setEmailSent(true);
    setIsRegistering(false);
    setError({});
  };

  const { form, handleAuthenticationError } = useAuthFormHook({
    isSignUp: true,
    onSubmitHandler: onSubmitEmailAuthHandler,
    error,
    setError,
    facebookText: 'Sign Up With Facebook',
    googleText: 'Sign Up With Google',
    emailHeading: 'Sign Up By E-mail',
    continueText: 'Continue'
  });

  const handleRegistrationAndLogin = async (email, password) => {
    try {
      //Upon successful registration, a confirmation e-mail is sent to the
      //user. See authorization in Realm.
      await app.emailPasswordAuth.registerUser(email, password);
    } catch (err) {
      alert('error!' + err);
      handleAuthenticationError(err);
    }
  };

  const classes = useAuthStyles();

  dispatch(appActions.setPageLoaded());

  return (
    <>
      {isRegistering && !emailSent && (
        <CircularProgress className={classes.centeredTopQuarter} />
      )}
      {!emailSent && !isRegistering && form}
      {emailSent && (
        <div className={classes.centeredTopQuarter}>
          Check your inbox for a message requesting e-mail confirmation. Follow
          the link to be redirected back to this site where you can log in.
        </div>
      )}
    </>
  );
}
