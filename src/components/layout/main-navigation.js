import Link from "next/link";
import { useRouter } from "next/router";
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/realm-app';

import classes from "./main-navigation.module.css";

function MainNavigation() {
  const currentUser = useSelector(state => state.realm.app.currentUser);
  const dispatch = useDispatch();
  const router = useRouter();

  const logoutHandler = () => {
    dispatch(logout());
    router.push("/");
  }

  return (
    <header className={classes.header}>
      <nav>
        <ul>

          {!currentUser && (
            <li>
              <Link href="/login">Login</Link>
            </li>
          )}
          {currentUser && (
            <li>
              <Link href="/profile">Profile</Link>
            </li>
          )}

          {currentUser && (
            <li>
              <button onClick={logoutHandler}>Logout</button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}

export default MainNavigation;
