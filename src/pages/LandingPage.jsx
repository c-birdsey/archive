import { Link } from "react-router-dom";

export default function LandingPage({ showExploreLinks = false, notice = null, onFamiliesClick }) {
  return (
    <div className="landing-page">
      <div className="info-content">
        <p>
          Register is an architectural archive for tracing a graphic record of
          ideas and and unconscious references. It is structured with
          minimal hierarchy, instead focusing on connections between and across
          authors and topics.
          {showExploreLinks && (
            <>
              {" "}Explore via <Link to="/index">Entries</Link> or{" "}
              <button type="button" className="link-btn landing-inline-link" onClick={onFamiliesClick}>
                Families
              </button>
              .
            </>
          )}
        </p>
        {notice && <p className="landing-notice">{notice}</p>}
      </div>
    </div>
  );
}
