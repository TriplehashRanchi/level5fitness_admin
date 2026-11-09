import Link from "next/link";
import { ConsoleIcon } from "@/components/console-icon";
import styles from "./landing.module.css";

export const metadata = {
  title: "The team behind every stronger member",
  description: "The L5 Fitness staff workspace for member management, personal diet plans, workouts and class schedules.",
};

const tools = [
  { number: "01", icon: "members", title: "People first. Always.", description: "Keep your member directory organized, invite dietitians and connect members with the right person.", detail: "Members & team management" },
  { number: "02", icon: "plan", title: "A plan for each person.", description: "Build daily diet plans, review shared body profiles and follow the meals your clients complete.", detail: "Diet planning & client progress" },
  { number: "03", icon: "workout", title: "Keep the gym moving.", description: "Manage the workout catalog and class timetable from the same workspace your team already uses.", detail: "Workouts & class schedules" },
];

const questions = [
  ["Who can use the console?", "The L5 Fitness admin and invited dietitians. Sign in with the Google account linked to your staff access. A member account alone does not grant console access."],
  ["What can a dietitian see?", "Dietitians work with members assigned to them who have chosen to share their fitness details. Administrators manage the team and member assignments."],
  ["Do members need to complete their profile first?", "Members can start using the app before completing their fitness profile. Shared body details become available for diet planning after they complete their profile and enable sharing."],
  ["Where do dashboard numbers come from?", "The signed-in dashboard uses records from the L5 Fitness API. Weekly activity and diet-plan completion are labeled with their reporting period; this landing page contains no member data."],
];

function Brand() {
  return <Link href="/" className={styles.brand} aria-label="L5 Fitness home"><span className={styles.brandMark}>L5</span><span>FITNESS<span className={styles.brandSub}>TEAM WORKSPACE</span></span></Link>;
}

function WorkspacePreview() {
  return (
    <div className={styles.preview} aria-label="Illustration of the L5 Fitness workspace, not live account data">
      <div className={styles.previewTop}><span className={styles.windowDots}><i /><i /><i /></span><span>YOUR TEAM. ONE WORKSPACE.</span><ConsoleIcon name="shield" size={16} /></div>
      <div className={styles.previewBody}>
        <div className={styles.previewRail} aria-hidden="true"><span>L5</span><ConsoleIcon name="members" /><ConsoleIcon name="plan" /><ConsoleIcon name="workout" /><ConsoleIcon name="calendar" /></div>
        <div className={styles.previewContent}>
          <div className={styles.previewHeading}><div><small>THE BIGGER PICTURE</small><h2>A little more clarity.</h2></div><span className={styles.previewTag}>Staff console</span></div>
          <div className={styles.orbitPanel}>
            <svg className={styles.orbit} viewBox="0 0 300 230" fill="none" aria-hidden="true">
              <circle cx="150" cy="115" r="88" stroke="#303930" strokeWidth="1" />
              <circle cx="150" cy="115" r="68" stroke="#c6f432" strokeWidth="18" strokeDasharray="295 133" transform="rotate(-90 150 115)" />
              <circle cx="150" cy="115" r="68" stroke="#c6f432" strokeOpacity=".1" strokeWidth="18" />
              <path d="M124 102v26m52-26v26m-61-20v14m70-14v14m-61-7h52" stroke="#f3f5e9" strokeWidth="5" strokeLinecap="round" />
              <circle cx="150" cy="27" r="4" fill="#c6f432" />
            </svg>
            <div className={styles.orbitCaption}><span className={styles.miniLabel}>BUILT AROUND YOUR MEMBERS</span><strong>Care. Plan.<br />Progress.</strong><p>Give your team the space<br />to focus on people.</p></div>
          </div>
          <div className={styles.previewRows}>{[{ icon: "members", label: "Member directory", detail: "People & assignments" }, { icon: "plan", label: "Personal diet plans", detail: "Meals & completion" }, { icon: "calendar", label: "Class timetable", detail: "Sessions & schedules" }].map((item) => <div key={item.label}><span className={styles.previewRowIcon}><ConsoleIcon name={item.icon} size={17} /></span><span><strong>{item.label}</strong><small>{item.detail}</small></span><ConsoleIcon name="arrow" size={16} /></div>)}</div>
        </div>
      </div>
      <div className={styles.previewBottom}><ConsoleIcon name="shield" size={13} /><span>Illustrative workspace · Sign in to see your data</span></div>
    </div>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <header className={styles.header}>
        <div className={styles.container}>
          <Brand />
          <nav aria-label="Landing page"><a href="#workspace">Workspace</a><a href="#team">For your team</a><a href="#questions">Questions</a></nav>
          <Link href="/login" className={styles.navCta}>Staff sign in <ConsoleIcon name="diagonal" size={16} /></Link>
        </div>
      </header>
      <main id="main-content">
        <section className={`${styles.hero} ${styles.container}`} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span /> THE PEOPLE BEHIND THE PROGRESS</div>
            <h1 id="hero-title">Stronger members.<br /><em>Better together.</em></h1>
            <p className={styles.heroDescription}>A clearer space to run your gym. Bring your members, diet plans and daily operations together, so your team can focus on what matters.</p>
            <div className={styles.heroActions}><Link href="/dashboard" className={styles.primaryCta}>Open your workspace <ConsoleIcon name="arrow" /></Link><a href="#workspace" className={styles.textCta}>Take a closer look <span>↓</span></a></div>
            <div className={styles.accessNote}><ConsoleIcon name="shield" size={16} /><span>For the L5 Fitness admin & invited dietitians.</span></div>
          </div>
          <WorkspacePreview />
        </section>
        <div className={`${styles.capabilityStrip} ${styles.container}`} aria-label="Workspace capabilities"><span>LESS SWITCHING.<br /><strong>MORE DOING.</strong></span>{[{ icon: "members", label: "Member management" }, { icon: "plan", label: "Personal diet plans" }, { icon: "calendar", label: "Gym operations" }].map((item) => <div key={item.label}><ConsoleIcon name={item.icon} /><span>{item.label}</span></div>)}</div>
        <section id="workspace" className={`${styles.section} ${styles.container}`} aria-labelledby="workspace-title">
          <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>A PLACE FOR THE IMPORTANT THINGS</span><h2 id="workspace-title">Less admin.<br />More attention.</h2></div><p>Purposeful tools for the work behind every member’s progress. Organized, connected and easy to find.</p></div>
          <div className={styles.toolGrid}>{tools.map((tool) => <article key={tool.number} className={styles.toolCard}><div className={styles.toolTop}><span className={styles.toolIcon}><ConsoleIcon name={tool.icon} size={25} /></span><span>{tool.number}</span></div><h3>{tool.title}</h3><p>{tool.description}</p><div className={styles.toolDetail}>{tool.detail}<ConsoleIcon name="check" size={16} /></div></article>)}</div>
        </section>
        <section id="team" className={`${styles.teamSection} ${styles.container}`} aria-labelledby="team-title">
          <div className={styles.teamIntro}><span className={styles.eyebrow}>DIFFERENT ROLES. SHARED PURPOSE.</span><h2 id="team-title">Your team.<br />In its element.</h2><p>The right workspace for each role, with member sharing choices kept in view.</p><span className={styles.teamStamp}><ConsoleIcon name="shield" size={18} /> Access follows your staff role</span></div>
          <div className={styles.roleList}><article><span className={styles.roleNumber}>01 / ADMIN</span><h3>Keep the whole gym in view.</h3><p>Manage members and staff, assign dietitians, and keep workouts and classes organized.</p><Link href="/dashboard">Go to the overview <ConsoleIcon name="arrow" size={17} /></Link></article><article><span className={styles.roleNumber}>02 / DIETITIAN</span><h3>Make every plan personal.</h3><p>Review your assigned clients’ shared profiles, create meal plans and follow their completion.</p><Link href="/clients">Open client workspace <ConsoleIcon name="arrow" size={17} /></Link></article></div>
        </section>
        <section id="questions" className={`${styles.faqSection} ${styles.container}`} aria-labelledby="faq-title"><div><span className={styles.eyebrow}>GOOD TO KNOW</span><h2 id="faq-title">A little clarity<br />before you start.</h2></div><div className={styles.faqList}>{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
        <section className={`${styles.finalCta} ${styles.container}`} aria-labelledby="start-title"><div><span className={styles.miniLabel}>READY WHEN YOU ARE</span><h2 id="start-title">Let’s make a stronger day.</h2><p>Your members. Your team. Your L5 workspace.</p></div><Link href="/login" className={styles.darkCta}>Sign in to L5 Fitness <ConsoleIcon name="arrow" /></Link></section>
      </main>
      <footer className={`${styles.footer} ${styles.container}`}><Brand /><p>The workspace behind L5 Fitness.</p><Link href="/login">Staff access <ConsoleIcon name="diagonal" size={14} /></Link></footer>
    </div>
  );
}
