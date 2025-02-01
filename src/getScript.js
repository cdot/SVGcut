/**
 * Promise to load a script
 * @param {script} url url of the script
 * @return {Promise} a promise that resolves to undefined.
 */
export function getScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;

    script.onerror = (e) => {
      console.error(`Script load failed ${e}`);
      reject();
    };

    script.onload = script.onreadystatechange = function () {
      const loadState = this.readyState;

      if (loadState && loadState !== 'loaded' && loadState !== 'complete')
        return;

      script.onload = script.onreadystatechange = null;

      resolve();
    };
    document.head.appendChild(script);
  });
}
