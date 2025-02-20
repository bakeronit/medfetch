
class PubMedAPI {
    constructor() {
        this.SEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
        this.FETCH_URL = 'https://medfetch-production.up.railway.app/proxy';
        //this.FETCH_URL = 'http://127.0.0.1:5000/proxy'; // for local testing

        this.CONCURRENT_REQUESTS = 10; // Maximum concurrent requests
        this.REQUEST_DELAY = 100; // Delay between requests in ms (3 requests per second)
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

    async fetchPublicationDetailsWithRateLimit(pmids) {
        const queue = [...pmids];
        const results = new Array(pmids.length);
        const executing = new Set();

        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        async function executeRequest(pmid, index) {
            try {
                executing.add(pmid);
                const result = await this.fetchPublicationDetails(pmid);
                results[index] = result;
            } catch (error) {
                console.error(`Error fetching PMID ${pmid}:`, error);
                results[index] = null;
            } finally {
                executing.delete(pmid);
                await delay(this.REQUEST_DELAY);
            }
        }

        async function processQueue() {
            while (queue.length > 0) {
                if (executing.size < this.CONCURRENT_REQUESTS) {
                    const pmid = queue.shift();
                    const index = pmids.indexOf(pmid);
                    executeRequest.call(this, pmid, index);
                }
                await delay(100); // Small delay to check queue
            }
        }

        // Wait for all requests to complete
        await Promise.all([
            processQueue.call(this),
            ...Array.from({ length: this.CONCURRENT_REQUESTS }, () =>
                processQueue.call(this)
            )
        ]);

        // Wait for any remaining executing requests
        while (executing.size > 0) {
            await delay(100);
        }

        return results.filter(result => result !== null);
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