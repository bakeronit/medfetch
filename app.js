const pubmedAPI = new PubMedAPI();

function formatPublication(publication, searchedAffiliation) {
    // Make affiliation search case-insensitive and more flexible
    const searchTerms = searchedAffiliation.toLowerCase().split(/[\s,]+/);
    
    const affiliatedAuthors = publication.authors.filter((_, index) => {
        const affiliation = (publication.affiliations[index] || '').toLowerCase();
        return searchTerms.some(term => affiliation.includes(term));
    });

    // If no affiliated authors found, return null
    if (affiliatedAuthors.length === 0) {
        console.log('No affiliated authors found for publication:', publication);
        return null;
    }

    return `
        <div class="publication-card">
            <div class="publication-authors">
                <span class="emoji">🔬</span>
                ${affiliatedAuthors.join(', ')}
            </div>
            <div class="publication-title">
                <span class="emoji">📚</span>
                ${publication.title}
            </div>
            <div class="publication-journal">
                <span class="emoji">📝</span>
                ${publication.journal}
            </div>
            ${publication.doi ? `
                <div class="publication-doi">
                    <span class="emoji">🔗</span>
                    <a href="https://doi.org/${publication.doi}" target="_blank">
                        https://doi.org/${publication.doi}
                    </a>
                </div>
            ` : ''}
        </div>
    `;
}

document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const affiliation = document.getElementById('affiliation').value;
    const weeks = parseInt(document.getElementById('weeks').value, 10);
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    
    // Clear previous results
    resultsDiv.innerHTML = '';
    loadingDiv.classList.remove('d-none');
    
    try {
        console.log('Searching for:', { affiliation, weeks });
        
        // Search for PMIDs
        const pmids = await pubmedAPI.searchPMIDs(affiliation, weeks);
        console.log('Found PMIDs:', pmids);
        
        if (pmids.length === 0) {
            resultsDiv.innerHTML = `
                <div class="alert alert-info">
                    No publications found for "${affiliation}" in the last ${weeks} week(s).
                </div>
            `;
            return;
        }

        // Show number of publications found
        resultsDiv.innerHTML = `
            <div class="alert alert-info">
                Found ${pmids.length} publications. Fetching details...
            </div>
        `;

        // Fetch details for each PMID
        //const publications = await Promise.all(
        //    pmids.map(pmid => pubmedAPI.fetchPublicationDetails(pmid))
        //);
        const publications = await pubmedAPI.fetchPublicationDetailsWithRateLimit(pmids);
        console.log("here")

        // Filter out null results and format each publication
        const formattedPublications = publications
            .filter(pub => pub !== null)
            .map(pub => formatPublication(pub, affiliation))
            .filter(pub => pub !== null); // Filter out publications with no affiliated authors

        if (formattedPublications.length === 0) {
            resultsDiv.innerHTML = `
                <div class="alert alert-warning">
                    Found publications but none matched the affiliation "${affiliation}" exactly.
                    Try using a shorter or more general affiliation name.
                </div>
            `;
            return;
        }

        resultsDiv.innerHTML = `
            <div class="alert alert-success mb-4">
                Found ${formattedPublications.length} publications matching "${affiliation}".
            </div>
            ${formattedPublications.join('')}
        `;
        
    } catch (error) {
        console.error('Error:', error);
        resultsDiv.innerHTML = `
            <div class="alert alert-danger">
                An error occurred: ${error.message}
                <br><br>
                Please try:
                <ul>
                    <li>Using a shorter or more general affiliation name</li>
                    <li>Reducing the number of weeks to search</li>
                    <li>Checking your internet connection</li>
                </ul>
            </div>
        `;
    } finally {
        loadingDiv.classList.add('d-none');
    }
});