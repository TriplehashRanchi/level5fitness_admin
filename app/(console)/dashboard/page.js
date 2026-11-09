import View from "./view";

export const metadata = { title: "Dashboard" };

// This page only appears after the browser has confirmed who is signed in, so there is nothing to
// prerender for instant navigation. Declaring that keeps the dev overlay from warning about it.
export const instant = false;

export default function Page() {
  return <View />;
}
