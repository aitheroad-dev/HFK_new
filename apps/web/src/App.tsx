import { CRM } from "@/components/atomic-crm/root/CRM";
import { HkfDemo } from "./HkfDemo";

/**
 * Application entry point
 *
 * Set USE_HKF_DEMO=true in URL params to view the new HKF-branded interface.
 * Example: http://localhost:5173/?demo=hkf
 *
 * Customize Atomic CRM by passing props to the CRM component:
 *  - contactGender
 *  - companySectors
 *  - darkTheme
 *  - dealCategories
 *  - dealPipelineStatuses
 *  - dealStages
 *  - lightTheme
 *  - logo
 *  - noteStatuses
 *  - taskTypes
 *  - title
 * ... as well as all the props accepted by shadcn-admin-kit's <Admin> component.
 *
 * @example
 * const App = () => (
 *    <CRM
 *       logo="./img/logo.png"
 *       title="Acme CRM"
 *    />
 * );
 */
const App = () => {
  // Check URL params for demo mode
  const params = new URLSearchParams(window.location.search);
  const isHkfDemo = params.get("demo") === "hkf";

  if (isHkfDemo) {
    return <HkfDemo />;
  }

  return <CRM />;
};

export default App;
