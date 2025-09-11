import React from "react";
import { Mail, MapPin, Phone, Globe, Linkedin, Twitter, Github } from "lucide-react";

const ContactFooter = () => {
  return (
    <footer id="contact-footer" className="bg-gray-900 text-white py-12">
      <div className="section-container">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-4">
              <img src="/logo.svg" alt="TeamIQ Logo" className="h-8 w-auto mr-3 invert" />
              <span className="text-xl font-bold">TeamIQ</span>
            </div>
            <p className="text-gray-300 mb-6 max-w-md">
              The first scientific tool to measure, analyze, and improve collective intelligence. 
              Transform your team meetings with AI-powered insights.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-3 text-pulse-400" />
                <a href="mailto:hello@teamiq.ai" className="text-gray-300 hover:text-white transition-colors">
                  hello@teamiq.ai
                </a>
              </div>
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-3 text-pulse-400" />
                <a href="tel:+1-555-0123" className="text-gray-300 hover:text-white transition-colors">
                  +1 (555) 012-3456
                </a>
              </div>
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-3 text-pulse-400" />
                <span className="text-gray-300">
                  San Francisco, CA
                </span>
              </div>
              <div className="flex items-center">
                <Globe className="w-4 h-4 mr-3 text-pulse-400" />
                <a href="https://collective-intelligence-analyzer.lovable.app/" target="_blank" className="text-gray-300 hover:text-white transition-colors">
                  Try Live Demo
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <div className="space-y-3">
              <a href="#features" className="block text-gray-300 hover:text-white transition-colors">
                How It Works
              </a>
              <a href="#customize" className="block text-gray-300 hover:text-white transition-colors">
                Get Started
              </a>
              <a href="https://collective-intelligence-analyzer.lovable.app/" target="_blank" className="block text-gray-300 hover:text-white transition-colors">
                Live Demo
              </a>
              <a href="#" className="block text-gray-300 hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="block text-gray-300 hover:text-white transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} TeamIQ. All rights reserved. Empowering collective intelligence worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ContactFooter;