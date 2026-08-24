import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import logoImage from "../../assets/d83767957783007976f4c71d1b997e4eb7d271d2.png";
import backgroundImage from "../../assets/ad7a828277c00d550babbaa6465177a38994f948.png";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative flex items-center justify-center p-8 overflow-hidden">
      {/* Background image with 50% opacity */}
      <div className="absolute inset-0">
        <img 
          src={backgroundImage} 
          alt="Museum Interior Background"
          className="w-full h-full object-cover opacity-50"
        />
      </div>

      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-blue-900/40 to-blue-800/40"></div>

      <div className="max-w-4xl w-full text-center relative z-10">
        {/* Museum Image */}
        <div className="mb-12 rounded-2xl overflow-hidden shadow-2xl mx-auto">
          <img 
            src={logoImage} 
            alt="Hiyas Museum Building" 
            className="w-full h-auto"
          />
        </div>

        {/* Button */}
        <Button
          onClick={() => navigate("/login")}
          className="bg-white hover:bg-gray-100 text-blue-900 px-16 py-6 text-xl font-semibold rounded-lg shadow-2xl transform transition hover:scale-105"
        >
          Enter Museum Dashboard
        </Button>
      </div>
    </div>
  );
}