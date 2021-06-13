import {
  FacebookLoginButton,
  GoogleLoginButton
} from "react-social-login-buttons";
import useAuthStyles from "./auth-styles";

export default function SocialButtons(props) {
  const classes = useAuthStyles();
  return (
      <>
      <div className={classes.loginButton}>
        <FacebookLoginButton
          style={{ fontSize: props.fontSize }}
          text={props.facebook.text}
          onClick={props.facebook.onClickHandler}
        />
      </div>
      <div className={classes.loginButton}>
        <GoogleLoginButton
          style={{ fontSize: props.fontSize }}
          text={props.google.text}
          onClick={props.google.onClickHandler}
        />
      </div>
      </>
  );
}
