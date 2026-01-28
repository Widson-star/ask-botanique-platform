Ask Botanique 🌱
Environmental Decision Intelligence for East African Landscaping
An intelligent plant recommendation platform that helps landscapers and gardeners 
select the right plants based on site-specific environmental conditions.
🎯 What It Does
Ask Botanique analyzes your site conditions (rainfall, soil type, sunlight) and 
recommends plants with a 0-100 suitability score based on:

Rainfall Compatibility (30%) - Will it get enough water naturally?
Sunlight Matching (25%) - Does it match your sun exposure?
Soil Suitability (20%) - Can it thrive in your soil type?
Maintenance Level (15%) - How much care does it need?
Native Species Bonus (10%) - Is it ecologically adapted?

🚀 Live Demo
Frontend: ask-botanique-platform-1.onrender.com
API: ask-botanique-api.onrender.com
📊 Features

✅ Smart plant recommendations based on environmental conditions
✅ 111 East African plants (expanding to 100+ with climate data)
✅ Multi-criteria scoring algorithm
✅ Transparent explanations (match reasons + warnings)
✅ Native species prioritization
✅ Search and filter functionality
✅ Clean, responsive UI

🛠 Tech Stack
Backend:

Node.js + Express
PostgreSQL (Supabase)
ES6 modules

Frontend:

Vanilla HTML/CSS/JavaScript
No framework dependencies
Mobile-responsive design

Deployment:

Render (backend + frontend)
GitHub Actions for CI/CD

📖 API Documentation
Get Recommendations
bashGET /api/recommend?rainfall=800&soil_type=loam&sunlight=full%20sun
Parameters:

rainfall (integer, 400-2000): Annual rainfall in mm
soil_type (string): clay, loam, or sandy
sunlight (string): "full sun", "partial shade", or "shade"

Response:
json{
  "total_analyzed": 111,
  "recommendations": [
    {
      "plant": {
        "id": "...",
        "scientific_name": "Markhamia lutea",
        "common_names": ["Nile Trumpet", "Mukwa"],
        "category": "Tree",
        ...
      },
      "suitability_score": 100,
      "match_reasons": [
        "Thrives in 800mm annual rainfall",
        "Perfect sunlight match (Full sun)",
        "Thrives in loam soil",
        "Low-maintenance plant",
        "Native East African species"
      ],
      "warnings": []
    }
  ]
}
Search Plants
bashGET /plants?search=palm&sunlight=Full%20sun&category=Tree
🗺 Roadmap

 Expand to 100+ plants with complete climate data
 Location presets (Nairobi, Mombasa, Kisumu, etc.)
 User accounts and saved recommendations
 Export recommendations to PDF
 API authentication for third-party access
 Plant care schedules
 Image recognition for plant identification

📚 Data Sources

Kenya Horticultural Society (KHS)
Kenya Forestry Research Institute (KEFRI)
Field observations from Botanique Designers projects

🤝 Contributing
Contributions welcome! Especially:

Climate data for additional plants
UI/UX improvements
Bug reports and feature requests

📝 License
MIT License
👤 Author
Widson Ambaisi

Building Ask Botanique
Background in landscape architecture + full-stack development
LinkedIn: https://www.linkedin.com/in/widson-ambaisi-0108a068/
Twitter: https://x.com/SecAnalystX
