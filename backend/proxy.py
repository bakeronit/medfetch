import os
from flask import Flask, request
from flask_cors import CORS  # 允许跨域, 一知半解
import requests
#from dotenv import load_dotenv

#load_dotenv()
##PUBMED_API_KEY=os.environ.get("PUBMED_API_KEY")

app = Flask(__name__)
CORS(app)  # 允许所有来源访问

@app.route('/proxy', methods=['GET'])
def proxy():
    pubmed_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    params = {
        "db": "pubmed",
        "id": request.args.get("id"),
        "retmode": "xml",
        "api_key": PUBMED_API_KEY
    }
    response = requests.get(pubmed_url, params=params)
    return (response.text, response.status_code, {
        "Content-Type": "application/xml"
    })

if __name__ == '__main__':
    print("This is a proxy server for using PubMed API")
    PUBMED_API_KEY=os.getenv("PUBMED_API_KEY")

    if not PUBMED_API_KEY:
        raise ValueError("PUBMED_API_KEY environment variable is not set")
    print(PUBMED_API_KEY)
    app.run(host="0.0.0.0", port=5000)