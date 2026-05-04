import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Users, Target, Hash, User, Video } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CustomizationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    organization: '',
    meetingTitle: '',
    keywords: '',
    yourName: '',
    roomName: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.organization) {
      toast({ title: "Required", description: "Please describe your organization.", variant: "destructive" });
      return;
    }
    if (!formData.yourName.trim()) {
      toast({ title: "Required", description: "Please enter your name to join the call.", variant: "destructive" });
      return;
    }

    const room = (formData.roomName || `teamiq-${Math.random().toString(36).slice(2, 8)}`)
      .toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const params = new URLSearchParams({
      org: formData.organization,
      title: formData.meetingTitle || 'Team Meeting',
      room,
      name: formData.yourName.trim(),
      keywords: formData.keywords.trim(),
    });

    navigate(`/meeting-analysis?${params.toString()}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-gray-50" id="customize">
      <div className="section-container">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="pulse-chip mx-auto mb-6">
              <span>Personalized Setup</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Customize Your <span className="text-pulse-500">Team Intelligence</span> Analysis
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Tell us about your organization and meeting so we can provide real-time AI-powered insights.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Your Name */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 mr-2 text-pulse-500" />
                  Your Name *
                </label>
                <input
                  type="text"
                  name="yourName"
                  value={formData.yourName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Alex Johnson"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                />
              </div>

              {/* Room Name */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Video className="w-4 h-4 mr-2 text-pulse-500" />
                  Room Name (optional)
                </label>
                <input
                  type="text"
                  name="roomName"
                  value={formData.roomName}
                  onChange={handleInputChange}
                  placeholder="Leave blank to auto-generate"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Share the same name with teammates so they join the same room.</p>
              </div>

              {/* Organization */}
              <div className="md:col-span-2">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 mr-2 text-pulse-500" />
                  Organization Description *
                </label>
                <textarea
                  name="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                  required
                  placeholder="Tell us about your organization (e.g., Tech startup, Educational institution, etc.)"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              {/* Meeting Title */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Target className="w-4 h-4 mr-2 text-pulse-500" />
                  Meeting Title
                </label>
                <input
                  type="text"
                  name="meetingTitle"
                  value={formData.meetingTitle}
                  onChange={handleInputChange}
                  placeholder="e.g., Weekly Strategy Session"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                />
              </div>

              {/* (participants are auto-detected when they join the room) */}

              {/* Keywords */}
              <div className="md:col-span-2">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Hash className="w-4 h-4 mr-2 text-pulse-500" />
                  Keywords to Monitor (Optional)
                </label>
                <input
                  type="text"
                  name="keywords"
                  value={formData.keywords}
                  onChange={handleInputChange}
                  placeholder="e.g., innovation, budget, timeline (comma-separated)"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-8 text-center">
              <button type="submit" className="button-primary group inline-flex items-center">
                Launch Custom Analysis
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-sm text-gray-500 mt-4">
                Opens a real-time AI analysis dashboard alongside your meeting
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default CustomizationForm;
