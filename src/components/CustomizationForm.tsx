import React, { useState } from "react";
import { ArrowRight, Users, Target, Hash, MessageSquare } from "lucide-react";

const CustomizationForm = () => {
  const [formData, setFormData] = useState({
    organization: '',
    meetingTitle: '',
    agenda: '',
    participantSize: '',
    keywords: '',
    additionalInfo: ''
  });
  
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    
    // Simulate form processing
    setTimeout(() => {
      // Redirect to the main app with customization parameters
      const params = new URLSearchParams({
        org: formData.organization,
        meeting: formData.meetingTitle || 'Team Collaboration Session',
        agenda: formData.agenda || 'Strategic planning and decision-making session',
        size: formData.participantSize,
        keywords: formData.keywords
      });
      
      window.open(`https://collective-intelligence-analyzer.lovable.app/?${params.toString()}`, '_blank');
    }, 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (isSubmitted) {
    return (
      <section className="py-12 sm:py-16 md:py-20 bg-gray-50" id="customize">
        <div className="section-container">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="w-8 h-8 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <h3 className="text-2xl font-bold mb-4">Setting Up Your Analysis...</h3>
            <p className="text-gray-600 mb-6">
              We're customizing the collective intelligence analyzer for {formData.organization}. 
              You'll be redirected to your personalized dashboard shortly.
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-pulse-500 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

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
              Tell us about your organization and meetings so we can provide the most relevant insights for your team's collective intelligence.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  placeholder="Tell us about your organization (e.g., Tech startup, Educational institution, Non-profit, etc.)"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                  rows={3}
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

              {/* Participant Size */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 mr-2 text-pulse-500" />
                  Typical Participation Size *
                </label>
                <select
                  name="participantSize"
                  value={formData.participantSize}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                >
                  <option value="">Select size</option>
                  <option value="3-5">3-5 people</option>
                  <option value="6-10">6-10 people</option>
                  <option value="11-20">11-20 people</option>
                  <option value="21-50">21-50 people</option>
                  <option value="50+">50+ people</option>
                </select>
              </div>

              {/* Agenda */}
              <div className="md:col-span-2">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4 mr-2 text-pulse-500" />
                  Meeting Agenda (Optional)
                </label>
                <textarea
                  name="agenda"
                  value={formData.agenda}
                  onChange={handleInputChange}
                  placeholder="Describe your typical meeting agenda or leave blank for us to generate one"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                  rows={3}
                />
              </div>

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
                  placeholder="e.g., innovation, budget, timeline, strategy (comma-separated)"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Specify keywords you want the AI to pay special attention to during analysis
                </p>
              </div>

              {/* Additional Info */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Additional Information (Optional)
                </label>
                <textarea
                  name="additionalInfo"
                  value={formData.additionalInfo}
                  onChange={handleInputChange}
                  placeholder="Any specific goals, challenges, or requirements for your team analysis?"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-8 text-center">
              <button
                type="submit"
                className="button-primary group inline-flex items-center"
              >
                Launch Customized Analysis
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-sm text-gray-500 mt-4">
                This will open your personalized TeamIQ dashboard in a new tab
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default CustomizationForm;