package com.etqadem.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.LinkedHashSet;
import org.junit.Test;

public class DocStartScriptTest {
    @Test public void emptyVaultStillSetsMarker() {
        assertTrue(DocStartScript.build(null, false).contains("window.__etqVault=\"\";"));
        assertTrue(DocStartScript.build("", true).contains("window.__etqVault=\"\";"));
        assertTrue(DocStartScript.build("", true).contains("window.__etqMotion=true;"));
        assertTrue(DocStartScript.build("", false).contains("window.__etqMotion=false;"));
    }

    @Test public void topFrameGuard() {
        assertTrue(DocStartScript.build("x", false).contains("window!==window.top"));
    }

    @Test public void escapesQuotesAndBackslashes() {
        assertEquals("\"{\\\"rt\\\":\\\"a\\\\b\\\"}\"", DocStartScript.quote("{\"rt\":\"a\\b\"}"));
    }

    @Test public void noScriptCloserOrRawLineTerminators() {
        String q = DocStartScript.quote("a</script><!--&  \n\r\t\u0001");
        assertFalse(q.contains("<"));
        assertFalse(q.contains("</"));
        assertFalse(q.contains(" "));
        assertFalse(q.contains(" "));
        assertFalse(q.contains("\n"));
        assertTrue(q.contains("\\u2028") && q.contains("\\u2029") && q.contains("\\u003c"));
        assertTrue(q.contains("\\/"));
    }

    @Test public void unicodeTextPassesThrough() {
        assertEquals("\"اتقدم\"", DocStartScript.quote("اتقدم"));
    }

    @Test public void origins() {
        assertEquals("https://etqadem.cloider.app", DocStartScript.originOf("https://etqadem.cloider.app/app/"));
        assertEquals("http://10.0.2.2:8080", DocStartScript.originOf("http://10.0.2.2:8080/app/?x=1#y"));
        assertEquals("https://a.b", DocStartScript.originOf("HTTPS://A.B"));
        assertNull(DocStartScript.originOf(null));
        assertNull(DocStartScript.originOf("file:///x"));
        assertNull(DocStartScript.originOf("not a url"));
        assertEquals(new LinkedHashSet<>(Arrays.asList("https://etqadem.cloider.app", "https://localhost")),
            DocStartScript.allowedOrigins("https://etqadem.cloider.app/app/"));
        assertEquals(new LinkedHashSet<>(Arrays.asList("https://localhost")), DocStartScript.allowedOrigins(null));
    }
    @Test public void debugFlagMarker() {
        assertTrue(DocStartScript.build("", false, true).contains("window.__etqDebug=true;"));
        assertTrue(DocStartScript.build("", false).contains("window.__etqDebug=false;"));
    }
}
