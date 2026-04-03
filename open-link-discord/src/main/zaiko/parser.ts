import * as cheerio from 'cheerio';

export function isItemInStock(html: string) {
  const $ = cheerio.load(html);
  const inStockItems: { url: string | null; name: string }[] = [];

  // Check if this is a wishlist page by looking for wishlist item containers
  const listItems = $('.mod-shoppingListContents_list');
  
  if (listItems.length > 0) {
    // It's a wishlist page
    listItems.each((_i, el) => {
      const item = $(el);
      const productName = item.find('.productName b').text().trim();
      let productUrl = item.find('.productName a').attr('href');
      
      if (productUrl && !productUrl.startsWith('http')) {
         productUrl = 'https://7net.omni7.jp' + productUrl;
      }

      let inStock = false;
      // Look at all action buttons for this item
      item.find('p.cartBtn').each((_j, btnEl) => {
        const btnStyle = $(btnEl).attr('style') || '';
        // If the button wrapper is not hidden
        if (!btnStyle.replace(/\s/g, '').includes('display:none')) {
          const btnText = $(btnEl).text().trim();
          if (btnText.includes('カートに入れる') || btnText.includes('予約する')) {
            inStock = true;
          }
        }
      });

      if (inStock && productUrl) {
        inStockItems.push({ url: productUrl, name: productName });
      }
    });

    return inStockItems;
  }

  // Fallback: It's a single product page
  const cartBtn = $('input[value="カートに入れる"]');
  const reserveBtn = $('input[value="予約する"]');
  const cartLink = $('a:contains("カートに入れる")');
  const reserveLink = $('a:contains("予約する")');

  if (cartBtn.length > 0 || reserveBtn.length > 0 || cartLink.length > 0 || reserveLink.length > 0) {
    return [{ url: null, name: 'Target Product' }];
  }
  
  return [];
}
