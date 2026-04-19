"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import styles from "./Navbar.module.css";

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.logo}>
        chess<span className={styles.logoAccent}>time</span>
      </Link>

      <div className={styles.right}>
        {user ? (
          <>
            <Link href="/friends" className={styles.friendsLink}>
              Friends
            </Link>
            <Link href="/profile" className={styles.userInfo}>
              {user.name}
              <span className={styles.rating}>{user.rating}</span>
            </Link>
            <button onClick={signOut} className={styles.signOutBtn}>
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className={styles.signInBtn}>
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
