
class PubMedAPI {
    constructor() {
        this.SEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
        this.FETCH_URL = 'https://medfetch-production.up.railway.app/proxy';
        //this.FETCH_URL = 'http://127.0.0.1:5000/proxy';
    }

    async searchPMIDs(affiliation, weeksAgo = 1) {
        // Calculate dates in YYYY/MM/DD format as required by PubMed
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (weeksAgo * 7));
        const endDate = new Date();
        
        const formattedStartDate = startDate.toISOString().split('T')[0].replace(/-/g, '/');
        const formattedEndDate = endDate.toISOString().split('T')[0].replace(/-/g, '/');
        
        // Construct a more flexible affiliation search
        // Remove special characters and escape quotes
        const cleanAffiliation = affiliation.replace(/['"]/g, '').trim();
        
        const params = new URLSearchParams({
            db: 'pubmed',
            term: `"${cleanAffiliation}"[Affiliation]`,
            retmax: 100,
            retmode: 'json',
            datetype: 'pdat',
            mindate: formattedStartDate,
            maxdate: formattedEndDate,
            usehistory: 'y' // Use PubMed's history server for better results
        });

        try {
            const response = await fetch(`${this.SEARCH_URL}?${params}`);
            if (!response.ok) throw new Error('Search request failed');
            const data = await response.json();
            return data.esearchresult.idlist || [];
        } catch (error) {
            console.error('Error searching PMIDs:', error);
            throw error;
        }
    }

    async fetchPublicationDetails(pmid) {
        const params = new URLSearchParams({
            db: 'pubmed',
            id: pmid,
            retmode: 'xml'
        });

        try {
            const response = await fetch(`${this.FETCH_URL}?${params}`);
            if (!response.ok) throw new Error('Fetch request failed');
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            
            return this.parsePublicationXML(xmlDoc);
        } catch (error) {
            console.error('Error fetching publication details:', error);
            throw error;
        }
    }

    parsePublicationXML(xmlDoc) {
        const article = xmlDoc.querySelector('PubmedArticle');
        if (!article) return null;

        const title = article.querySelector('ArticleTitle')?.textContent || 'No title available';
        const journal = article.querySelector('Journal Title')?.textContent || 
                       article.querySelector('ISOAbbreviation')?.textContent || 'Journal not specified';
        
        const authors = Array.from(article.querySelectorAll('Author')).map(author => {
            const lastName = author.querySelector('LastName')?.textContent || '';
            const foreName = author.querySelector('ForeName')?.textContent || '';
            return `${lastName} ${foreName}`.trim();
        });

        const affiliations = Array.from(article.querySelectorAll('Affiliation')).map(aff => 
            aff.textContent || ''
        );

        const doi = article.querySelector('ArticleId[IdType="doi"]')?.textContent || '';

        return {
            title,
            journal,
            authors,
            affiliations,
            doi
        };
    }
}